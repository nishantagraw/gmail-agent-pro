import axios from 'axios';

// Create axios instance with base URL from environment
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    withCredentials: true
});

export default api;
