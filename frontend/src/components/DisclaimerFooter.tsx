import React from 'react';

export default function DisclaimerFooter() {
  return (
    <footer 
      role="contentinfo" 
      className="w-full border-t border-surface-light mt-auto"
    >
      <div className="max-w-5xl mx-auto py-6 px-8 flex flex-col items-center text-center">
        <p className="text-muted text-sm max-w-3xl leading-relaxed">
          ⚠️ <strong className="font-semibold">Disclaimer:</strong> WINI AI menyediakan analisis berbasis data publik dan bukan merupakan nasihat investasi. Keputusan investasi sepenuhnya menjadi tanggung jawab pengguna. Selalu lakukan riset mandiri dan konsultasi dengan penasihat keuangan profesional.
        </p>
      </div>
    </footer>
  );
}
