import { registerAs } from '@nestjs/config';

export default registerAs('leads', () => ({
  // When true: a submitted lead immediately creates a Customer + Account
  // with status='lead'. When false: the lead sits in 'submitted' state and
  // requires an admin to promote it via POST /v1/admin/leads/:id/promote.
  autoPromote: (process.env.LEADS_AUTO_PROMOTE || 'true').toLowerCase() === 'true',
}));
