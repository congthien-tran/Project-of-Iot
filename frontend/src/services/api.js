import axios from 'axios';

const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const API_BASE_URL = import.meta.env.VITE_API_URL || `http://${hostname}:5000/api/v1`;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
  headers: { 'Content-Type': 'application/json' }
});

export const getHealth = async () => (await apiClient.get('/health')).data;
export const getLatestTelemetry = async () => (await apiClient.get('/telemetry/latest')).data;
export const getTelemetryHistory = async (limit = 60) => (await apiClient.get(`/telemetry/history?limit=${limit}`)).data;
export const sendControlCommand = async (payload) => (await apiClient.post('/control', payload)).data;
