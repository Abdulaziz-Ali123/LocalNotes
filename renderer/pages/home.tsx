import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from "@/renderer/components/ui/button"

export default function HomePage() {
  return (
    <React.Fragment>
        <div className='absolute top-1/4 left-1/3 bg-secondary p-5 h-auto w-[600px] flex items-center flex-col justify-center rounded-2xl shadow-neumorph'>
          <div>
              <Image
                className="ml-auto mr-auto pb-5"
                src="/images/logo.png"datatype=''
                alt="Logo image"
                width={256}
                height={256}
              />
            </div>
          <div className="grid grid-col-1 text-2xl w-4/5 ">
            <div className='flex flex-row justify-between items-center py-3'>
              <span>
                Create New Folder
                <p className='text-sm pb-3'>Create a new folder to hold your notes</p>
              </span>
              <button className='bg-accent rounded-md text-base p-2 h-12 w-32 shadow-neumorph-sm active:shadow-neumorph-insert transition-all'> Create Folder </button>
            </div>
            <hr className='border-foreground/20'/>
            
            <div className='flex flex-row justify-between items-center py-3'>
              <span>
                Open an Existing Folder
                <p className='text-sm pb-3'>Open an existing folder that hold your notes</p>                       
              </span>
              <Link href="editor"> <button className='bg-accent rounded-md text-base p-2 h-12 w-32 shadow-neumorph-sm active:shadow-neumorph-insert transition-all'> Open Folder </button> </Link>
            </div>

            <hr className='border-foreground/20'/>
              <div className='flex flex-row justify-between items-center py-3'>
                <span>
                  Configure Settings
                  <p className='text-sm pb-3'>Edit settings like themes</p>
                </span>
                <button className='bg-accent rounded-md text-base p-2 h-12 w-32 shadow-neumorph-sm active:shadow-neumorph-insert transition-all'> List Folders </button>
            </div>
          </div>
        </div>
      
    </React.Fragment>
  )
}
