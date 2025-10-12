import axios from 'axios';
import { DreamRequest, Node } from './types';

const API_BASE_URL = 'http://localhost:3457';

export const dreamerAPI = {
  async healthCheck(): Promise<{ status: string; service: string; version: string }> {
    const response = await axios.get(`${API_BASE_URL}/`);
    return response.data;
  },

  async generateKnowledgeGraph(request: DreamRequest): Promise<Node[]> {
    const response = await axios.post<Node[]>(`${API_BASE_URL}/api/v1/dream`, request);
    return response.data;
  },
};
