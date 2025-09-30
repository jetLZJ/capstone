const http = require('http');
http.get('http://localhost:3000/api/menu', res => {
  console.log('status', res.statusCode);
  let data='';
  res.on('data', chunk=>data+=chunk);
  res.on('end', ()=>{
    try{console.log('body', JSON.parse(data));}catch(e){console.log('body', data)}
  });
}).on('error', err=>{
  console.error('err', err.message);
});
