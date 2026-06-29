import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable
} from "@tanstack/react-table";
import { Laptop, LoaderCircle, LogOut } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { authApi } from "@/features/auth/auth.api";
import { useAuthStore } from "@/features/auth/auth.store";
import type { Session } from "@/features/auth/auth.types";
import { ApiError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";

const column = createColumnHelper<Session>();

export function SessionsPage() {
  const [cursor, setCursor] = useState<string>();
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>(
    []
  );
  const [target, setTarget] = useState<Session>();
  const [error, setError] = useState<string>();
  const clear = useAuthStore((state) => state.clear);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["auth", "sessions", cursor],
    queryFn: () => authApi.sessions(cursor)
  });
  const revoke = useMutation({
    mutationFn: authApi.revokeSession,
    onSuccess: async (_, sessionId) => {
      setTarget(undefined);
      if (target?.isCurrent || query.data?.data.find((item) => item.id === sessionId)?.isCurrent) {
        clear();
        window.location.assign("/login");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
    },
    onError: (reason) => {
      setError(
        reason instanceof ApiError ? reason.message : "Unable to revoke session."
      );
    }
  });

  const columns = [
    column.accessor("userAgent", {
      header: "Device",
      cell: ({ row, getValue }) => (
        <div className="flex min-w-52 items-start gap-3">
          <Laptop className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <p className="line-clamp-2 text-sm">{getValue() ?? "Unknown device"}</p>
            {row.original.isCurrent ? (
              <Badge className="mt-1" variant="success">
                Current session
              </Badge>
            ) : null}
          </div>
        </div>
      )
    }),
    column.accessor("ipAddress", {
      header: "IP address",
      cell: (info) => info.getValue() ?? "Unknown"
    }),
    column.accessor("authenticationMethods", {
      header: "Authentication",
      cell: (info) => info.getValue().join(" + ").toUpperCase()
    }),
    column.accessor("lastUsedAt", {
      header: "Last active",
      cell: (info) => formatDateTime(info.getValue())
    }),
    column.accessor("expiresAt", {
      header: "Expires",
      cell: (info) => formatDateTime(info.getValue())
    }),
    column.display({
      id: "actions",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setTarget(row.original)}
        >
          <LogOut className="h-4 w-4" />
          Revoke
        </Button>
      )
    })
  ];

  const table = useReactTable({
    data: query.data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Active sessions</h1>
        <p className="text-muted-foreground">
          Review and revoke devices with access to your account.
        </p>
      </div>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>
            Revocation takes effect on the device’s next API request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading sessions
            </div>
          ) : query.isError ? (
            <Alert variant="destructive">Unable to load active sessions.</Alert>
          ) : (
            <>
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="text-center">
                        No active sessions found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="mt-4 flex gap-2">
                {cursorHistory.length ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const previous = cursorHistory.at(-1);
                      setCursorHistory((history) => history.slice(0, -1));
                      setCursor(previous);
                    }}
                  >
                    Previous page
                  </Button>
                ) : null}
                {query.data?.meta.hasMore ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCursorHistory((history) => [...history, cursor]);
                      setCursor(query.data?.meta.nextCursor ?? undefined);
                    }}
                  >
                    Next page
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(target)} onOpenChange={(open) => !open && setTarget(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke session?</DialogTitle>
            <DialogDescription>
              {target?.isCurrent
                ? "This is your current session. You will be signed out immediately."
                : "This device will need to authenticate again."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTarget(undefined)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={revoke.isPending}
              onClick={() => target && revoke.mutate(target.id)}
            >
              {revoke.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : null}
              Revoke
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
