'use client';

import Button from '@/components/ui/Button';
import Link from 'next/link';
import { signInWithEmail } from '@/utils/auth-helpers/server';
import { handleRequest } from '@/utils/auth-helpers/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface EmailSignInProps {
 allowPassword: boolean;
 redirectMethod: string;
 disableButton?: boolean;
}

export default function EmailSignIn({
 allowPassword,
 redirectMethod,
 disableButton
}: EmailSignInProps) {
 const router = redirectMethod === 'client' ? useRouter() : null;
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [focusedInput, setFocusedInput] = useState<string | null>(null);

 const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
   setIsSubmitting(true);
   await handleRequest(e, signInWithEmail, router);
   setIsSubmitting(false);
 };

 return (
   <div className="my-8">
     <form
       noValidate={true}
       className="relative backdrop-blur-xl bg-white/5 rounded-2xl p-8 border border-white/10 
                  shadow-[0_4px_24px_-1px_rgba(0,0,0,0.3)] transition-all duration-300 mb-4"
       onSubmit={(e) => handleSubmit(e)}
     >
       <div className="grid gap-4">
         <div className="relative">
           <label 
             htmlFor="email" 
             className="block text-sm font-medium text-zinc-300 mb-1 ml-1"
           >
             Email
           </label>
           <input
             id="email"
             placeholder="name@example.com"
             type="email"
             name="email"
             autoCapitalize="none"
             autoComplete="email"
             autoCorrect="off"
             className={`w-full p-3 rounded-xl bg-black/20 border border-white/10 
                        backdrop-blur-xl transition-all duration-300
                        focus:outline-none focus:ring-2 focus:ring-purple-500/50
                        hover:border-purple-500/30 ${
                          focusedInput === 'email' ? 'border-purple-500/50' : ''
                        }`}
             onFocus={() => setFocusedInput('email')}
             onBlur={() => setFocusedInput(null)}
           />
           {focusedInput === 'email' && (
             <div className="absolute inset-0 rounded-xl pointer-events-none">
               <div className="absolute inset-[-1px] rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 blur-sm" />
             </div>
           )}
         </div>

         <Button
           variant="slim"
           type="submit"
           className="mt-2 w-full bg-gradient-to-r from-purple-600 to-pink-600 
                    hover:from-purple-500 hover:to-pink-500
                    text-white font-medium py-3 rounded-xl
                    transition-all duration-300 transform hover:scale-[1.02]
                    disabled:opacity-70 disabled:cursor-not-allowed
                    focus:outline-none focus:ring-2 focus:ring-purple-500/50"
           loading={isSubmitting}
           disabled={disableButton}
         >
           Sign in
         </Button>
       </div>
     </form>

     {allowPassword && (
       <div className="mt-6 space-y-2">
         <p>
           <Link 
             href="/signin/password_signin" 
             className="text-sm text-zinc-400 hover:text-white transition-colors
                      hover:underline decoration-purple-500/30"
           >
             Sign in with email and password
           </Link>
         </p>
         <p>
           <Link 
             href="/signin/signup" 
             className="text-sm text-zinc-400 hover:text-white transition-colors
                      hover:underline decoration-purple-500/30"
           >
             Don't have an account? Sign up
           </Link>
         </p>
       </div>
     )}
   </div>
 );
}