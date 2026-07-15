import apiClient from './client';

export const listPaperSetups = async () => {
  const response = await apiClient.get('/v1/paper/setups');
  return response.data;
};

// payload matches PaperSetupCreate:
// { name, source_kind: 'symbol'|'preset', symbol?, preset_key?, top_n?,
//   market?, strategy: {...}, position_size? }
export const createPaperSetup = async (payload) => {
  const response = await apiClient.post('/v1/paper/setups', payload);
  return response.data;
};

export const stopPaperSetup = async (setupId) => {
  const response = await apiClient.post(`/v1/paper/setups/${setupId}/stop`);
  return response.data;
};

export const startPaperSetup = async (setupId) => {
  const response = await apiClient.post(`/v1/paper/setups/${setupId}/start`);
  return response.data;
};

export const deletePaperSetup = async (setupId) => {
  const response = await apiClient.delete(`/v1/paper/setups/${setupId}`);
  return response.data;
};

export const listPaperTrades = async ({ setupId, status, limit = 100 } = {}) => {
  const response = await apiClient.get('/v1/paper/trades', {
    params: {
      ...(setupId != null ? { setup_id: setupId } : {}),
      ...(status ? { status } : {}),
      limit,
    },
  });
  return response.data;
};

export const evaluatePaperNow = async (setupId) => {
  const response = await apiClient.post('/v1/paper/evaluate', null, {
    params: setupId != null ? { setup_id: setupId } : {},
  });
  return response.data;
};
