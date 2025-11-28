const supabase = require('../utils/supabase');
const User = require('../models/userModel');

exports.uploadAvatar = async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) return res.status(400).json({ message: "Nenhum ficheiro enviado" });

    const ext = file.originalname.split('.').pop();
    const filePath = `avatars/${id}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('avatars')
      .upload(filePath, file.buffer, {
        upsert: true,
        contentType: file.mimetype,
      });

    if (error) {
      console.error(error);
      return res.status(500).json({ message: "Erro ao enviar imagem para Supabase", error });
    }

    const { data: publicData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const publicUrl = publicData.publicUrl;

    User.updatePhoto(id, publicUrl, (err) => {
      if (err) return res.status(500).json({ error: err.message });

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
