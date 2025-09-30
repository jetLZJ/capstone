import http from '../utils/httpClient';

const list = async () => http.get('/api/menu/types').then(r => r.data?.types ?? []);

export default { list };
