import './globals.css'

export const metadata = {
  title: 'P2P Text Editor',
  description: 'Collaborative text editor with CRDT and WebRTC',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
