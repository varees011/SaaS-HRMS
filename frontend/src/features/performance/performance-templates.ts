export interface PerformanceTemplateKpi {
  description: string;
  targetValue?: number | null;
  weightage: number;
}

export interface PerformanceTemplateKra {
  title: string;
  description: string;
  weightage: number;
  kpis: PerformanceTemplateKpi[];
}

export interface PerformanceTemplateGoal {
  name: string;
  description: string;
  weightage: number;
  kras: PerformanceTemplateKra[];
}

export interface PerformanceTemplate {
  id: string;
  name: string;
  role: string;
  source: string;
  goals: PerformanceTemplateGoal[];
}

export const performanceTemplates: PerformanceTemplate[] = [
  {
    id: "system-engineer-cloud",
    name: "System Engineer Cloud KRA",
    role: "Systems Engineer",
    source: "KRA - Performance Review 1.0",
    goals: [
      {
        name: "Operational Excellence",
        description: "Cloud environment stability, service response, governance, and client satisfaction.",
        weightage: 70,
        kras: [
          {
            title: "Ensure Client Cloud Environment is Stable",
            description: "Maintain stable client cloud operations throughout the review period.",
            weightage: 25,
            kpis: [
              {
                description: "Ensure there are fewer than 5 P1 tickets in the review period.",
                targetValue: 5,
                weightage: 100
              }
            ]
          },
          {
            title: "Increase Efficiency in Responding and Fixing User Problems",
            description: "Reduce ticket SLA misses and improve resolution discipline.",
            weightage: 25,
            kpis: [
              {
                description: "Ensure the number of tickets breaching SLA is less than 5%.",
                targetValue: 5,
                weightage: 100
              }
            ]
          },
          {
            title: "Governance and Reporting",
            description: "Maintain report cadence and client meeting participation.",
            weightage: 25,
            kpis: [
              {
                description: "Ensure 100% of cadence reports are sent on time and all client monthly meetings are attended.",
                targetValue: 100,
                weightage: 100
              }
            ]
          },
          {
            title: "Increase Client Satisfaction with Technology Operations",
            description: "Improve client survey outcomes and reduce operational escalations.",
            weightage: 25,
            kpis: [
              {
                description: "Ensure client satisfaction survey scores are above 85%.",
                targetValue: 85,
                weightage: 50
              },
              {
                description: "Ensure there are fewer than 3 operational escalations during the review period.",
                targetValue: 3,
                weightage: 50
              }
            ]
          }
        ]
      },
      {
        name: "Technical Competencies and Corporate Citizenship",
        description: "Professional development, certifications, and knowledge contributions.",
        weightage: 30,
        kras: [
          {
            title: "Professional Development",
            description: "Complete mandatory learning and role-relevant certifications.",
            weightage: 50,
            kpis: [
              {
                description: "Ensure all assigned mandatory trainings are completed within the allocated time.",
                targetValue: 100,
                weightage: 50
              },
              {
                description: "Complete at least one certification course during the review period.",
                targetValue: 1,
                weightage: 50
              }
            ]
          },
          {
            title: "Corporate Citizenship",
            description: "Contribute reusable knowledge to the organization.",
            weightage: 50,
            kpis: [
              {
                description: "Ensure at least two white papers or blogs are written within the review period.",
                targetValue: 2,
                weightage: 100
              }
            ]
          }
        ]
      }
    ]
  },
  {
    id: "noc-engineer",
    name: "NOC Engineer KRA",
    role: "NOC Engineer",
    source: "KRA - Performance Review 1.0",
    goals: [
      {
        name: "Operational Excellence",
        description: "NOC response, follow-up, governance, and client satisfaction.",
        weightage: 70,
        kras: [
          {
            title: "Response SLA",
            description: "Meet first-response expectations for assigned NOC tickets.",
            weightage: 25,
            kpis: [
              {
                description: "Ensure response SLA is adhered to by at least 90%.",
                targetValue: 90,
                weightage: 100
              }
            ]
          },
          {
            title: "Ticket Follow-up",
            description: "Maintain daily follow-up discipline for open tickets.",
            weightage: 25,
            kpis: [
              {
                description: "Ensure all open tickets are followed up on a daily basis.",
                targetValue: 100,
                weightage: 100
              }
            ]
          },
          {
            title: "Governance and Reporting",
            description: "Maintain client reporting cadence.",
            weightage: 25,
            kpis: [
              {
                description: "Ensure 100% of cadence reports are sent on time.",
                targetValue: 100,
                weightage: 100
              }
            ]
          },
          {
            title: "Increase Client Satisfaction with Technology Operations",
            description: "Improve client survey outcomes and reduce operational escalations.",
            weightage: 25,
            kpis: [
              {
                description: "Ensure client satisfaction survey scores are above 85%.",
                targetValue: 85,
                weightage: 50
              },
              {
                description: "Ensure there are fewer than 3 operational escalations during the review period.",
                targetValue: 3,
                weightage: 50
              }
            ]
          }
        ]
      },
      {
        name: "Technical Competencies and Corporate Citizenship",
        description: "Professional development and process documentation contributions.",
        weightage: 30,
        kras: [
          {
            title: "Professional Development",
            description: "Complete mandatory learning and role-relevant certifications.",
            weightage: 50,
            kpis: [
              {
                description: "Ensure all assigned mandatory trainings are completed within the allocated time.",
                targetValue: 100,
                weightage: 50
              },
              {
                description: "Complete at least one certification course during the review period.",
                targetValue: 1,
                weightage: 50
              }
            ]
          },
          {
            title: "Corporate Citizenship",
            description: "Contribute process knowledge to the organization.",
            weightage: 50,
            kpis: [
              {
                description: "Help author at least 2 process documents.",
                targetValue: 2,
                weightage: 100
              }
            ]
          }
        ]
      }
    ]
  },
  {
    id: "software-engineer-product-support",
    name: "Software Engineer and Product Support KRA",
    role: "Software Engineer",
    source: "KRA - Performance Review 1.0",
    goals: [
      {
        name: "Product Stability",
        description: "Defect resolution, process adherence, and code quality.",
        weightage: 40,
        kras: [
          {
            title: "Ensure Product is Free of UI and Functional Defects",
            description: "Close defects according to severity commitments.",
            weightage: 34,
            kpis: [
              {
                description: "Close all defects as per severity: blocker immediate, critical within 2 hours, high within 4 hours, UI immediate.",
                targetValue: 100,
                weightage: 100
              }
            ]
          },
          {
            title: "Process Adherence",
            description: "Follow engineering workflow and documentation discipline.",
            weightage: 33,
            kpis: [
              {
                description: "Ensure all code is committed to Git.",
                targetValue: 100,
                weightage: 50
              },
              {
                description: "Ensure all fixes are documented.",
                targetValue: 100,
                weightage: 50
              }
            ]
          },
          {
            title: "Code Quality",
            description: "Maintain coding standards according to existing styles.",
            weightage: 33,
            kpis: [
              {
                description: "Maintain coding standards as per existing styles.",
                targetValue: 100,
                weightage: 100
              }
            ]
          }
        ]
      },
      {
        name: "Product Feature Enhancement",
        description: "Feature release quality and supporting documentation.",
        weightage: 30,
        kras: [
          {
            title: "Ensure Features are Released as Planned",
            description: "Release features without severe defects.",
            weightage: 50,
            kpis: [
              {
                description: "There must be zero blocker, critical, or high severity defects.",
                targetValue: 0,
                weightage: 100
              }
            ]
          },
          {
            title: "Release Notes and User Guides",
            description: "Document releases and feature changes clearly.",
            weightage: 50,
            kpis: [
              {
                description: "All feature development must have supporting release notes and user guide documentation.",
                targetValue: 100,
                weightage: 100
              }
            ]
          }
        ]
      },
      {
        name: "Technical Competencies and Corporate Citizenship",
        description: "Professional development, knowledge sharing, and technical contributions.",
        weightage: 30,
        kras: [
          {
            title: "Professional Development",
            description: "Complete mandatory learning and role-relevant certifications.",
            weightage: 50,
            kpis: [
              {
                description: "Ensure all assigned mandatory trainings are completed within the allocated time.",
                targetValue: 100,
                weightage: 50
              },
              {
                description: "Complete at least one certification course during the review period.",
                targetValue: 1,
                weightage: 50
              }
            ]
          },
          {
            title: "Corporate Citizenship",
            description: "Contribute written and live technical knowledge sharing.",
            weightage: 50,
            kpis: [
              {
                description: "Ensure at least two white papers or blogs are written within the review period.",
                targetValue: 2,
                weightage: 50
              },
              {
                description: "Impart technical training or knowledge sharing sessions once per quarter on a new topic.",
                targetValue: 1,
                weightage: 50
              }
            ]
          }
        ]
      }
    ]
  }
];
