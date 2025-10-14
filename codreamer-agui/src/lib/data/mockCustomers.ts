import type { Customer } from '@/components/canvas/CustomerListPanel';

export const MOCK_CUSTOMERS: Customer[] = [
  // 3 new customers
  {
    id: 'cust-1',
    name: 'Sarah Johnson',
    email: 'sarah.j@techcorp.com',
    companyName: 'TechCorp Inc.',
    status: 'new',
  },
  {
    id: 'cust-2',
    name: 'Michael Chen',
    email: 'mchen@innovatelab.io',
    companyName: 'InnovateLab',
    status: 'new',
  },
  {
    id: 'cust-3',
    name: 'Emily Rodriguez',
    email: 'emily.r@designstudio.co',
    companyName: 'Design Studio Co.',
    status: 'new',
  },
  // 2 opened customers
  {
    id: 'cust-4',
    name: 'David Kim',
    email: 'dkim@startupventures.com',
    companyName: 'Startup Ventures',
    status: 'opened',
  },
  {
    id: 'cust-5',
    name: 'Jessica Martinez',
    email: 'jmartinez@globaltech.net',
    companyName: 'Global Tech Networks',
    status: 'opened',
  },
  // 1 sent customer
  {
    id: 'cust-6',
    name: 'James Wilson',
    email: 'jwilson@enterprise.org',
    companyName: 'Enterprise Solutions',
    status: 'sent',
  },
];
