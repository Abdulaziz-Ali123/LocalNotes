import React from 'react'
import type { AppProps } from 'next/app'

import '../styles/globals.css'

function MyApp({ Component, pageProps }: AppProps) {
  return (
      <div className='h-screen w-full overflow-hidden'>
        <Component {...pageProps} />
      </div>
   )
}

export default MyApp
