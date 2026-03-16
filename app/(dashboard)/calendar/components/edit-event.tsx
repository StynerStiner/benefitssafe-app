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
import { CalendarIcon, Loader2, SquarePlus } from "lucide-react"
import * as React from "react"
import toast from "react-hot-toast"

function formatDate(date: Date | undefined) {
    if (!date) return ""
    return date.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    })
}

function isValidDate(date: Date | undefined) {
    if (!date) return false
    return !isNaN(date.getTime())
}

interface EditEventProps {
    onEditEvent: (event: any) => void;
    event: any;
}

const EditEvent: React.FC<EditEventProps> = ({ onEditEvent, event }) => {
    const [dialogOpen, setDialogOpen] = React.useState(false)
    const [submitForm, setSubmitForm] = React.useState(false)

    // states synced with event prop
    const [name, setName] = React.useState("")
    const [label, setLabel] = React.useState("")
    const [description, setDescription] = React.useState("")

    const [date, setDate] = React.useState<Date | undefined>()
    const [month, setMonth] = React.useState<Date | undefined>()
    const [value, setValue] = React.useState("")

    const [endDate, setEndDate] = React.useState<Date | undefined>()
    const [endMonth, setEndMonth] = React.useState<Date | undefined>()
    const [endValue, setEndValue] = React.useState("")

    const [open, setOpen] = React.useState(false)
    const [openEnd, setOpenEnd] = React.useState(false)

    // Load event values when dialog opens
    React.useEffect(() => {
        if (dialogOpen && event) {
            setName(event.title || "")
            setLabel(event.label || "")
            setDescription(event.description || "")
            setDate(event.startTime ? new Date(event.startTime) : undefined)
            setValue(event.startTime ? formatDate(new Date(event.startTime)) : "")
            setMonth(event.startTime ? new Date(event.startTime) : undefined)
            setEndDate(event.endTime ? new Date(event.endTime) : undefined)
            setEndValue(event.endTime ? formatDate(new Date(event.endTime)) : "")
            setEndMonth(event.endTime ? new Date(event.endTime) : undefined)
        }
    }, [dialogOpen, event])

    const handleModalFormSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!label) {
            toast.error("Please select an event type!")
            return
        }
        setSubmitForm(true)

        const updatedEvent = {
            id: event.id,
            title: name,
            color: label === "Personal" ? "bg-green-500" :
                label === "Business" ? "bg-primary" :
                    label === "Family" ? "bg-yellow-500" :
                        label === "Important" ? "bg-purple-500" :
                            "bg-red-500",
            label,
            startTime: value,
            endTime: endValue,
            description,
        }

        onEditEvent(updatedEvent)

        setTimeout(() => {
            setDialogOpen(false)
            setSubmitForm(false)
            toast.success("Event updated successfully!")
        }, 500)
    }

    return (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
                <span className="cursor-pointer flex items-center gap-2 px-2 py-1 text-neutral-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-sm">
                    <SquarePlus className="text-neutral-600 dark:text-white w-4" />
                    Edit
                </span>
            </DialogTrigger>

            <DialogContent className="!max-w-[800px] p-0">
                <div>
                    <DialogHeader>
                        <div className="py-4 px-6 border-b border-neutral-200 dark:border-neutral-600 flex items-center justify-between">
                            <DialogTitle>Edit Event</DialogTitle>
                        </div>
                    </DialogHeader>

                    <div className="p-6">
                        <form onSubmit={handleModalFormSubmit}>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

                                {/* Title */}
                                <div className="col-span-12">
                                    <label htmlFor="title" className="inline-block font-semibold text-neutral-600 dark:text-neutral-200 text-sm mb-2">
                                        Event Title :
                                    </label>
                                    <Input
                                        type="text"
                                        id="title"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="form-control border-neutral-300 px-5 shadow-none w-full h-[46px] rounded-lg"
                                        placeholder="Enter Event Title"
                                        required
                                    />
                                </div>

                                {/* Start Date */}
                                <div className="col-span-12 md:col-span-6">
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
                                                const d = new Date(e.target.value)
                                                setValue(e.target.value)
                                                if (isValidDate(d)) {
                                                    setDate(d)
                                                    setMonth(d)
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
                                            <PopoverContent className="w-auto overflow-hidden p-0" align="end" alignOffset={-8} sideOffset={10}>
                                                <Calendar
                                                    mode="single"
                                                    selected={date}
                                                    captionLayout="dropdown"
                                                    month={month}
                                                    onMonthChange={setMonth}
                                                    onSelect={(d) => {
                                                        setDate(d)
                                                        setValue(formatDate(d))
                                                        setOpen(false)
                                                    }}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>

                                {/* End Date */}
                                <div className="col-span-12 md:col-span-6">
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
                                                const d = new Date(e.target.value)
                                                setEndValue(e.target.value)
                                                if (isValidDate(d)) {
                                                    setEndDate(d)
                                                    setEndMonth(d)
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
                                            <PopoverContent className="w-auto overflow-hidden p-0" align="end" alignOffset={-8} sideOffset={10}>
                                                <Calendar
                                                    mode="single"
                                                    selected={endDate}
                                                    captionLayout="dropdown"
                                                    month={endMonth}
                                                    onMonthChange={setEndMonth}
                                                    onSelect={(d) => {
                                                        setEndDate(d)
                                                        setEndValue(formatDate(d))
                                                        setOpenEnd(false)
                                                    }}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>

                                {/* Event Type */}
                                <div className="col-span-12">
                                    <RadioGroup
                                        value={label}
                                        onValueChange={(val) => setLabel(val)}
                                        className="flex items-center flex-wrap gap-7"
                                    >
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="Personal" id="Personal" className="border border-neutral-400" required />
                                            <Label htmlFor="Personal" className="font-medium text-sm flex items-center gap-1">
                                                <span className="w-2 h-2 bg-green-500 rounded-full"></span> Personal
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="Business" id="Business" className="border border-neutral-400" required />
                                            <Label htmlFor="Business" className="font-medium text-sm flex items-center gap-1">
                                                <span className="w-2 h-2 bg-blue-500 rounded-full"></span> Business
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="Family" id="Family" className="border border-neutral-400" required />
                                            <Label htmlFor="Family" className="font-medium text-sm flex items-center gap-1">
                                                <span className="w-2 h-2 bg-yellow-500 rounded-full"></span> Family
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="Important" id="Important" className="border border-neutral-400" required />
                                            <Label htmlFor="Important" className="font-medium text-sm flex items-center gap-1">
                                                <span className="w-2 h-2 bg-purple-500 rounded-full"></span> Important
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="Holiday" id="Holiday" className="border border-neutral-400" required />
                                            <Label htmlFor="Holiday" className="font-medium text-sm flex items-center gap-1">
                                                <span className="w-2 h-2 bg-red-500 rounded-full"></span> Holiday
                                            </Label>
                                        </div>
                                    </RadioGroup>
                                </div>

                                {/* Description */}
                                <div className="col-span-12">
                                    <label htmlFor="desc" className="inline-block font-semibold text-neutral-600 dark:text-neutral-200 text-sm mb-2">
                                        Description
                                    </label>
                                    <Textarea
                                        id="desc"
                                        className="form-control border-neutral-300 px-5 shadow-none w-full h-[120px]"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Write some text..."
                                    />
                                </div>

                                {/* Footer */}
                                <div className="col-span-12">
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button
                                                variant="outline"
                                                className="h-[50px] px-8 border-red-600 hover:bg-red-100 hover:bg-red-600 text-red-600"
                                            >
                                                Cancel
                                            </Button>
                                        </DialogClose>
                                        <Button type="submit" className="h-[50px] !px-8">
                                            {submitForm ? (
                                                <>
                                                    <Loader2 className="animate-spin h-4.5 w-4.5" />
                                                    Saving...
                                                </>
                                            ) : (
                                                "Save changes"
                                            )}
                                        </Button>
                                    </DialogFooter>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default EditEvent
