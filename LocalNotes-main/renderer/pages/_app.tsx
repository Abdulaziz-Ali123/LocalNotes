import React from 'react'
import type { AppProps } from 'next/app'

import '../styles/globals.css'

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <div className='h-screen w-full overflow-hidden'>
        <div className='app-drag-region h-14 border-secondary/50 flex justify-center items-center'> 
          <div className='p-1 h-9 rounded-full w-1/3 text-center bg-secondary'>
            LocalNotes
          </div>
        </div>
      <Component {...pageProps} />
    </div>)
}

export default MyApp
