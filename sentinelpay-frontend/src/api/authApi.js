import apiClient from './axiosConfig';

/**
 * authApi — wraps POST /auth/register and POST /auth/login
 *
 * Both endpoints are public (no JWT required).
 * Both return AuthResponse: { token, email, name, upiId, message }
 */

/**
 * Register a new user.
 * @param {{ name: string, email: string, password: string }} payload
 * @returns {Promise<{ token, email, name, upiId, message }>}
 */
export const register = async (payload) => {
  const { data } = await apiClient.post('/auth/register', payload);
  return data;
};

/**
 * Log in and receive a JWT token.
 * @param {{ email: string, password: string }} payload
 * @returns {Promise<{ token, email, name, upiId, message }>}
 */
export const login = async (payload) => {
  const { data } = await apiClient.post('/auth/login', payload);
  return data;
};

/**
 * Check auth-service liveness.
 */
export const healthCheck = async () => {
  const { data } = await apiClient.get('/auth/health');
  return data;
};
