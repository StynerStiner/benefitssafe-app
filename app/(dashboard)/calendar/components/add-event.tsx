
"use client"

import { Button } from '@/components/ui/button'
import { Calendar } from "@/components/ui/calendar"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { CalendarIcon, Loader2, SquarePlus } from "lucide-react"
import * as React from "react"
import toast from "react-hot-toast"

function formatDate(date: Date | undefined) {
    if (!date) {
        return ""
    }

    return date.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    })
}

function isValidDate(date: Date | undefined) {
    if (!date) {
        return false
    }
    return !isNaN(date.getTime())
}

interface AddEventProps {
    onAddEvent: (event: any) => void;
}


const AddEvent: React.FC<AddEventProps> = ({ onAddEvent }) => {
    const [open, setOpen] = React.useState(false)
    const [date, setDate] = React.useState<Date | undefined>(
        new Date("2025-06-01")
    )
    const [month, setMonth] = React.useState<Date | undefined>(date)
    const [value, setValue] = React.useState(formatDate(date))

    // End date states
    const [openEnd, setOpenEnd] = React.useState(false)
    const [endDate, setEndDate] = React.useState<Date | undefined>(new Date("2025-06-01"))
    const [endMonth, setEndMonth] = React.useState<Date | undefined>(endDate)
    const [endValue, setEndValue] = React.useState(formatDate(endDate))


    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [submitForm, setSubmitForm] = React.useState(false);

    // Data send to the event list 
    const [name, setName] = React.useState("");
    const [label, setLabel] = React.useState("");
    const [description, setDescription] = React.useState("");

    const handleModalFormSubmit = (event: any) => {
        event.preventDefault();
        if (!label) {
            toast.error("Please select an event type!");
            return;
        }
        setSubmitForm(true);

        const newEvent = {
            id: Date.now(),
            title: name,
            color: label === "Personal" ? "bg-green-500" :
                label === "Business" ? "bg-primary" :
                    label === "Family" ? "bg-yellow-500" :
                        label === "Important" ? "bg-purple-500" :
                            "bg-red-500",
            label: label,
            startTime: value,
            endTime: endValue,
            description: description,
        };

        onAddEvent(newEvent);
        setName("");
        setValue("");
        setEndValue("");
        setLabel("");
        setDescription("");

        setTimeout(() => {
            setDialogOpen(false);
            setSubmitForm(false);
            toast.success(
                <span>
                    <strong>{name}</strong> <br /> Event added successfully!
                </span>
            );
        }, 500);
    }


    return (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
                <Button className={cn('h-11 justify-center w-full')}>
                    <SquarePlus width={22} />
                    Add Event
                </Button>
            </DialogTrigger>

            <DialogContent className='!max-w-[800px] p-0'>
                <div className="">

                    <DialogHeader className=''>
                        <div className="py-4 px-6 border-b border-neutral-200 dark:border-neutral-600 flex items-center justify-between">
                            <DialogTitle>Add New Event</DialogTitle>
                        </div>
                    </DialogHeader>

                    <div className="p-6">
                        <form action="#" onSubmit={handleModalFormSubmit}>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                <div className="col-span-12">
                                    <label htmlFor="title" className="inline-block font-semibold text-neutral-600 dark:text-neutral-200 text-sm mb-2">Event Title : </label>
                                    <Input type="text" id="title" value={name} onChange={(event) => setName(event.target.value)} className="form-control border-neutral-300 px-5 shadow-none w-full h-[46px] rounded-lg" placeholder="Enter Event Title" required />
                                </div>


                                <div className="col-span-12 md:col-span-6">
                                    <div>
                                        <Label htmlFor="date" className="inline-block font-semibold text-neutral-600 dark:text-neutral-200 text-sm mb-2">
                                            Start Date
                                        </Label>
                                        <div className="relative flex gap-2">
                                            <Input
                                                id="date"
                                                value={value}
                                                placeholder="June 01, 2025"
                                                className="form-control border-neutral-300 px-5 shadow-none w-full h-[46px] rounded-lg pe-10"
                                                required
                                                onChange={(e) => {
                                                    const date = new Date(e.target.value)
                                                    setValue(e.target.value)
                                                    if (isValidDate(date)) {
                                                        setDate(date)
                                                        setMonth(date)
                                                    }
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === "ArrowDown") {
                                                        e.preventDefault()
                                                        setOpen(true)
                                                    }
                                                }}
                                            />
                                            <Popover open={open} onOpenChange={setOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        id="date-picker"
                                                        variant="ghost"
                                                        className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
                                                    >
                                                        <CalendarIcon className="size-3.5" />
                                                        <span className="sr-only">Select date</span>
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent
                                                    className="w-auto overflow-hidden p-0"
                                                    align="end"
                                                    alignOffset={-8}
                                                    sideOffset={10}
                                                >
                                                    <Calendar
                                                        mode="single"
                                                        selected={date}
                                                        captionLayout="dropdown"
                                                        month={month}
                                                        onMonthChange={setMonth}
                                                        onSelect={(date) => {
                                                            setDate(date)
                                                            setValue(formatDate(date))
                                                            setOpen(false)
                                                        }}
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-span-12 md:col-span-6">
                                    <div>
                                        <Label htmlFor="dateEnd" className="inline-block font-semibold text-neutral-600 dark:text-neutral-200 text-sm mb-2">
                                            End Date
                                        </Label>
                                        <div className="relative flex gap-2">
                                            <Input
                                                id="dateEnd"
                                                value={endValue}
                                                placeholder="June 01, 2025"
                                                className="form-control border-neutral-300 px-5 shadow-none w-full h-[46px] rounded-lg pe-10"
                                                required
                                                onChange={(e) => {
                                                    const date = new Date(e.target.value)
                                                    setEndValue(e.target.value)
                                                    if (isValidDate(date)) {
                                                        setEndDate(date)
                                                        setEndMonth(date)
                                                    }
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === "ArrowDown") {
                                                        e.preventDefault()
                                                        setOpenEnd(true)
                                                    }
                                                }}
                                            />
                                            <Popover open={openEnd} onOpenChange={setOpenEnd}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        id="date-picker"
                                                        variant="ghost"
                                                        className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
                                                    >
                                                        <CalendarIcon className="size-3.5" />
                                                        <span className="sr-only">Select date</span>
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent
                                                    className="w-auto overflow-hidden p-0"
                                                    align="end"
                                                    alignOffset={-8}
                                                    sideOffset={10}
                                                >
                                                    <Calendar
                                                        mode="single"
                                                        selected={date}
                                                        captionLayout="dropdown"
                                                        month={endMonth}
                                                        onMonthChange={setEndMonth}
                                                        onSelect={(date) => {
                                                            setEndDate(date)
                                                            setEndValue(formatDate(date))
                                                            setOpenEnd(false)
                                                        }}
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-span-12">
                                    <RadioGroup
                                        defaultValue="Personal"
                                        value={label}
                                        onValueChange={(val) => setLabel(val)}
                                        className='flex items-center flex-wrap gap-7'
                                    >
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="Personal" id="Personal" className='border border-neutral-400'
                                                required />
                                            <Label className="form-check-label line-height-1 font-medium text-neutral-500 dark:text-neutral-300 text-sm flex items-center gap-1" htmlFor="Personal">
                                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                                Personal
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="Business" id="Business" className='border border-neutral-400'
                                                required />
                                            <Label className="form-check-label line-height-1 font-medium text-neutral-500 dark:text-neutral-300 text-sm flex items-center gap-1" htmlFor="Business">
                                                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                                Business
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="Family" id="Family" className='border border-neutral-400'
                                                required />
                                            <Label className="form-check-label line-height-1 font-medium text-neutral-500 dark:text-neutral-300 text-sm flex items-center gap-1" htmlFor="Family">
                                                <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                                                Family
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="Important" id="Important" className='border border-neutral-400'
                                                required />
                                            <Label className="form-check-label line-height-1 font-medium text-neutral-500 dark:text-neutral-300 text-sm flex items-center gap-1" htmlFor="Important">
                                                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                                                Important
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="Holiday" id="Holiday" className='border border-neutral-400'
                                                required />
                                            <Label className="form-check-label line-height-1 font-medium text-neutral-500 dark:text-neutral-300 text-sm flex items-center gap-1" htmlFor="Holiday">
                                                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                                                Holiday
                                            </Label>
                                        </div>
                                    </RadioGroup>
                                </div>
                                <div className="col-span-12">
                                    <label htmlFor="desc" className="inline-block font-semibold text-neutral-600 dark:text-neutral-200 text-sm mb-2">Description</label>
                                    <Textarea className="form-control border-neutral-300 px-5 shadow-none w-full h-[120px]" value={description} onChange={(event) => setDescription(event.target.value)} id='desc'
                                        placeholder='Write some text...' />
                                </div>
                                <div className="col-span-12">
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button variant="outline" className='h-[50px] px-8 border-red-600 hover:bg-red-100 hover:bg-red-600 text-red-600'>Cancel</Button>
                                        </DialogClose>
                                        <Button type="submit" className='h-[50px] !px-8'>
                                            {
                                                submitForm ? (
                                                    <>
                                                        <Loader2 className="animate-spin h-4.5 w-4.5" />
                                                        Saving...
                                                    </>
                                                ) : (
                                                    <>
                                                        Save changes
                                                    </>
                                                )
                                            }
                                        </Button>
                                    </DialogFooter>
                                </div>
                            </div>
                        </form>
                    </div>

                </div>
            </DialogContent>
        </Dialog>
    );
};

export default AddEvent;