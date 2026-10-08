import React from 'react';

export default function DisclaimerFooter() {
  return (
    <footer 
      role="contentinfo" 
      className="w-full border-t border-surface-light mt-auto"
    >
      <div className="max-w-5xl mx-auto py-6 px-8 flex flex-col items-center text-center">
        <p className="text-muted text-sm max-w-3xl leading-relaxed">
          ⚠️ <strong className="font-semibold">Disclaimer Edukasi:</strong> WINI AI menyediakan gambaran kuantitatif berbasis data historis publik dan bukan merupakan nasihat atau rekomendasi investasi (Pasar Modal OJK). Keputusan investasi sepenuhnya menjadi tanggung jawab pengguna.
        </p>
        <p className="text-slate-400 text-xs mt-2 max-w-2xl">
          🔒 <strong className="font-semibold text-slate-300">Privasi Suara:</strong> Suara pengguna diproses secara lokal di peramban (Web Speech API) hanya selama sesi aktif untuk transkripsi perintah dan <em>tidak pernah direkam atau disimpan di server kami</em>.
        </p>
      </div>
    </footer>
  );
}
