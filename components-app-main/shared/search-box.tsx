import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import { Input } from '../ui/input';

import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import Link from 'next/link';
  

const SearchBox = () => {
    return (
        <Dialog>
            <DialogTrigger>
                <div className="relative sm:max-w-[388px] w-full cursor-pointer">
                    <Input 
                        className={cn("bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 shadow-none focus-visible:ring-0 focus-visible:border-primary border border-slate-300 h-10 pe-6 ps-11 w-full cursor-pointer disabled:opacity-[1] dark:border-slate-600 sm:block hidden")} 
                        placeholder="Search..." 
                        disabled
                    />
                    <span className="sm:absolute sm:top-[50%] sm:start-0 sm:ms-4 sm:-translate-y-[50%]">
                        <Search className='text-neutral-500 dark:text-white' width={18} height={18} />
                    </span>
                </div>
            </DialogTrigger>

            <DialogContent className={cn('p-0 !max-w-[620px] overflow-hidden')}>
                <DialogTitle className='hidden'>Search...</DialogTitle>
                <Command>
                    <CommandInput placeholder="Type a command or search..." />
                    <CommandList className='scrollbar-thin scrollbar-invisible hover:scrollbar-visible max-h-[400px]'>
                        <CommandEmpty>No results found.</CommandEmpty>
                        <CommandGroup heading="Application" className="mt-2">
                            <CommandItem className="p-0">
                                <Link href="/email" className='py-2 px-3 w-full'> 
                                    Email
                                </Link>
                            </CommandItem>
                            <CommandItem className="p-0">
                                <Link href="/chat" className='py-2 px-3 w-full'> 
                                    Chat
                                </Link>
                            </CommandItem>
                            <CommandItem className="p-0">
                                <Link href="/calendar" className='py-2 px-3 w-full'> 
                                    Calendar
                                </Link>
                            </CommandItem>
                            <CommandItem className="p-0">
                                <Link href="/kanban" className='py-2 px-3 w-full'> 
                                    Kanban
                                </Link>
                            </CommandItem>
                        </CommandGroup>
                        <CommandSeparator className="my-2" />
                        <CommandGroup heading="UI Elements">
                            <CommandItem className="p-0">
                                <Link href="/typography" className='py-2 px-3 w-full'> 
                                    Typography
                                </Link>
                            </CommandItem>
                            <CommandItem className="p-0">
                                <Link href="/colors" className='py-2 px-3 w-full'> 
                                    Colors
                                </Link>
                            </CommandItem>
                            <CommandItem className="p-0">
                                <Link href="/button" className='py-2 px-3 w-full'> 
                                    Button
                                </Link>
                            </CommandItem>
                            <CommandItem className="p-0">
                                <Link href="/dropdown" className='py-2 px-3 w-full'> 
                                    Dropdown
                                </Link>
                            </CommandItem>
                            <CommandItem className="p-0">
                                <Link href="/alert" className='py-2 px-3 w-full'> 
                                    Alert
                                </Link>
                            </CommandItem>
                            <CommandItem className="p-0">
                                <Link href="/tab" className='py-2 px-3 w-full'> 
                                    Tab
                                </Link>
                            </CommandItem>
                        </CommandGroup>
                        <CommandSeparator className="my-2" />
                        <CommandGroup heading="Setting">
                            <CommandItem className="p-0">
                                <Link href="/gallery" className='py-2 px-3 w-full'> 
                                    Gallery
                                </Link>
                            </CommandItem>
                            <CommandItem className="p-0">
                                <Link href="/pricing" className='py-2 px-3 w-full'> 
                                    Pricing
                                </Link>
                            </CommandItem>
                            <CommandItem className="p-0">
                                <Link href="/faq" className='py-2 px-3 w-full'> 
                                    FAQ
                                </Link>
                            </CommandItem>
                        </CommandGroup>
                        <CommandSeparator className="my-2" />
                        <CommandGroup heading="Auth">
                            <CommandItem className="p-0">
                                <Link href="/signIn" className='py-2 px-3 w-full'> 
                                    Sign In
                                </Link>
                            </CommandItem>
                            <CommandItem className="p-0">
                                <Link href="/signUp" className='py-2 px-3 w-full'> 
                                    Sign Up
                                </Link>
                            </CommandItem>
                            <CommandItem className="p-0">
                                <Link href="/forgotPassword" className='py-2 px-3 w-full'> 
                                    Forgot Password
                                </Link>
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>
                </Command>
            </DialogContent>
        </Dialog>
    );
};

export default SearchBox;