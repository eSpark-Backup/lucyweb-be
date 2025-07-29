export interface OrganizationDetails {
  id: number;
  name: string;
  address: string;
  owner: {
    fullName: string;
    email: string;
  };
  subscription?: {
    package: string;
    cost: number;
    validity: number;
    status: string | null;
  };
  userCount?: number;
}
