import './globals.css'
import { ModalProvider } from './components/ui/modal-provider'
export const metadata = {
  title: 'P2P Text Editor',
  description: 'Collaborative text editor with CRDT and WebRTC',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <ModalProvider>
          {children}
        </ModalProvider>
      </body>
    </html>
  )
}
