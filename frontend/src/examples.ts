import { IconBrandWhatsapp, IconBuilding, IconCash } from '@tabler/icons-react'

export interface Example {
  label: string
  icon: typeof IconCash
  title?: string
  text: string
  company_profile?: string
  has_logo?: 'Yes' | 'No' | 'Not sure'
}

export const EXAMPLES: Example[] = [
  {
    label: 'WhatsApp task scam', icon: IconBrandWhatsapp, title: 'Part time job',
    text: 'Hello! We are hiring for part time work from home. Earn Rs 3000 to 8000 per day by liking YouTube videos. No experience required, students and housewives can apply. Contact on WhatsApp +91 98765 43210 now!',
  },
  {
    label: 'Pay-to-join scam', icon: IconCash, title: 'Data Entry Operator',
    text: 'Congratulations! You are selected for Data Entry job at Amazon without interview. Salary 35,000/month. Pay Rs 1499 registration fee and send Aadhaar card copy to confirm your seat. Limited seats, hurry!',
  },
  {
    label: 'Genuine internship', icon: IconBuilding, title: 'Software Engineer Intern',
    text: 'Infosys is hiring Software Engineering Interns for Summer 2027 in Bengaluru. Requirements: pursuing B.Tech/B.E in Computer Science, knowledge of Java or Python, data structures. Selection process includes an online test and two technical interviews. Apply through the Infosys careers portal.',
    company_profile: 'Infosys is a global leader in next-generation digital services and consulting.',
    has_logo: 'Yes',
  },
]
