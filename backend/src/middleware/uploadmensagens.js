//const multer = require('multer');
//const path = require('path');
//const fs = require('fs');
//
//const msgUploadsDir = path.join(__dirname, '..', 'uploads_mensagens');
//
//if (!fs.existsSync(msgUploadsDir)) {
//  fs.mkdirSync(msgUploadsDir, { recursive: true });
//}
//
//const storage = multer.diskStorage({
//  destination: (req, file, cb) => {
//    cb(null, msgUploadsDir);
//  },
//  filename: (req, file, cb) => {
//    const ext = path.extname(file.originalname); 
//    const nome = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
//    cb(null, nome);
//  },
//});
//
//const uploadMensagem = multer({ storage });
//
//module.exports = uploadMensagem;
