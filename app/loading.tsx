import { Loader2 } from "lucide-react";

export default function Loading() {
    return (
        <div className="p-6 text-center fixed h-[100vh] start-0 top-0 w-full z-50 bg-white flex justify-center items-center gap-2">
            <Loader2 className="animate-spin !w-8 !h-8" />
            <span className="text-xl font-semibold">Loading....</span>
        </div>
    )
}
