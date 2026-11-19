const ok = { description: 'OK' };
const secured = [{ bearerAuth: [] }];
const id = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };
const page = [
  { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
];
const q = (name, extra = {}) => ({ name, in: 'query', schema: { type: 'string', ...extra } });
const body = (props, required = Object.keys(props)) => ({
  required: true, content: { 'application/json': { schema: { type: 'object', required, properties: props } } },
});

export const openapi = {
  openapi: '3.0.3',
  info: { title: 'ParkShare API', version: '1.0.0', description: 'P2P parking marketplace. All responses: { success, data, meta? } or { success:false, error }.' },
  servers: [{ url: '/api/v1' }],
  components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
  paths: {
    '/auth/request-otp': { post: { tags: ['Auth'], summary: 'Send OTP to phone', requestBody: body({ phone: { type: 'string', example: '+919876543210' } }), responses: { 200: ok, 429: { description: 'Rate limited' } } } },
    '/auth/verify-otp': { post: { tags: ['Auth'], summary: 'Verify OTP, returns access token + sets refresh cookie',
      requestBody: body({ phone: { type: 'string' }, otp: { type: 'string', example: '123456' }, name: { type: 'string' }, role: { type: 'string', enum: ['seeker', 'host'] } }, ['phone', 'otp']), responses: { 200: ok, 401: { description: 'Invalid OTP' } } } },
    '/auth/refresh': { post: { tags: ['Auth'], summary: 'Rotate refresh token (cookie) and get a new access token', responses: { 200: ok, 401: { description: 'Invalid token' } } } },
    '/auth/logout': { post: { tags: ['Auth'], summary: 'Revoke refresh token', responses: { 200: ok } } },
    '/auth/me': { get: { tags: ['Auth'], summary: 'Current user', security: secured, responses: { 200: ok } } },
    '/users/me': {
      get: { tags: ['Users'], summary: 'Get my profile', security: secured, responses: { 200: ok } },
      patch: { tags: ['Users'], summary: 'Update my name/email', security: secured, requestBody: body({ name: { type: 'string' }, email: { type: 'string' } }, []), responses: { 200: ok } },
    },
    '/users/me/become-host': { post: { tags: ['Users'], summary: 'Add host role; returns a fresh access token', security: secured, responses: { 200: ok } } },
    '/admin/stats': { get: { tags: ['Admin'], summary: 'Dashboard counts', security: secured, responses: { 200: ok, 403: { description: 'Not admin' } } } },
    '/admin/users': { get: { tags: ['Admin'], summary: 'List users', security: secured, parameters: [...page, q('search'), q('role', { enum: ['seeker', 'host', 'admin'] }), q('status', { enum: ['active', 'blocked'] })], responses: { 200: ok } } },
    '/admin/users/{id}/status': { patch: { tags: ['Admin'], summary: 'Block / unblock user', security: secured, parameters: [id], requestBody: body({ status: { type: 'string', enum: ['active', 'blocked'] } }), responses: { 200: ok } } },
    '/admin/listings': { get: { tags: ['Admin'], summary: 'List listings (filter by status)', security: secured, parameters: [...page, q('search'), q('status', { enum: ['draft', 'pending', 'approved', 'rejected', 'inactive'] })], responses: { 200: ok } } },
    '/admin/listings/{id}/status': { patch: { tags: ['Admin'], summary: 'Approve / reject listing', security: secured, parameters: [id], requestBody: body({ status: { type: 'string', enum: ['approved', 'rejected'] }, reason: { type: 'string' } }, ['status']), responses: { 200: ok } } },
    '/admin/bookings': { get: { tags: ['Admin'], summary: 'List bookings', security: secured, parameters: [...page, q('status')], responses: { 200: ok } } },
  },
};
