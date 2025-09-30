from api import create_app
app = create_app({'TESTING': True})
client = app.test_client()
import io, os
png = io.BytesIO(b'\x89PNG\r\n\x1a\n')
resp = client.post('/api/uploads/avatar', data={'file': (png, 'avatar.png')}, content_type='multipart/form-data')
print('status', resp.status_code)
print(resp.get_data(as_text=True))
print('uploads_dir_exists=', os.path.isdir(os.path.join(os.getcwd(),'html','uploads')))
if os.path.isdir(os.path.join(os.getcwd(),'html','uploads')):
    print('uploaded_files:', os.listdir(os.path.join(os.getcwd(),'html','uploads')))
