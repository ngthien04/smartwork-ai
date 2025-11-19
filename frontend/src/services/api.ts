import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api', // phải có /api
  withCredentials: true, // nếu dùng cookie
});

// Nếu dùng token:
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token'); // hoặc nơi lưu token
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;