import './globals.css';

export const metadata = {
  title: 'BI Dashboard Instructiva',
  description: 'Central de gestão da Escola Instructiva',
};
export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('tema')==='escuro')document.documentElement.dataset.tema='escuro'}catch(e){}" }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
