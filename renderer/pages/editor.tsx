import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Image from 'next/image'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/renderer/components/ui/resizable"

export default function Editor() {
  return (
    <React.Fragment>
      <ResizablePanelGroup
      direction="horizontal"
      className="min-h-screen w-full border-none bg-sidebar"
      >
      <ResizablePanel defaultSize={25}>
        <div className="flex h-full items-center justify-center p-6">
          <span className="font-semibold">File Tree</span>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle className='bg-transparent'/>
      <ResizablePanel defaultSize={75} minSize={60}>
        <div className="flex h-full items-center justify-center p-6 rounded-3xl bg-secondary">
          <span className="font-semibold">Text Editor</span>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
      

    </React.Fragment>
  )
}
