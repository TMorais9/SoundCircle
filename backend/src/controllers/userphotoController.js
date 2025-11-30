const fs = require('fs');
const path = require('path');
const User = require('../models/userModel');

const UPLOADS_DIR = path.resolve(__dirname, '..', '..', 'uploads');

const ensureUploadsDir = async () => {
  await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
};

exports.uploadAvatar = async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) return res.status(400).json({ message: "Nenhum ficheiro enviado" });

    await ensureUploadsDir();

    const ext = path.extname(file.originalname || '') || '.png';
    const filename = `${id}-${Date.now()}${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    await fs.promises.writeFile(filePath, file.buffer);

    const publicUrl = `/uploads/${filename}`;

    User.updatePhoto(id, publicUrl, (err) => {
      if (err) {
        fs.promises.unlink(filePath).catch(() => {});
        return res.status(500).json({ error: err.message });
      }

      res.json({
        message: "Avatar atualizado com sucesso",
        foto_url: publicUrl,
      });
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};
