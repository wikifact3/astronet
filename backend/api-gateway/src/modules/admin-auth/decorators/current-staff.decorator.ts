import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedStaff } from '../admin-auth.types';

export const CurrentStaff = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedStaff => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AuthenticatedStaff;
  },
);
