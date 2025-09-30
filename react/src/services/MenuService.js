import http from '../utils/httpClient';

const list = async () => http.get('/api/menu').then(r => r.data);
const get = async (id) => http.get(`/api/menu/${id}`).then(r => r.data);
const create = async (payload) => http.post('/api/menu', payload).then(r => r.data);
const update = async (id, payload) => http.put(`/api/menu/${id}`, payload).then(r => r.data);
const remove = async (id) => http.delete(`/api/menu/${id}`).then(r => r.data);

export default { list, get, create, update, remove };
