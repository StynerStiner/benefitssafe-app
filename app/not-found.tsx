import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

import ErrorThumbnail from "@/public/assets/images/error-img.png";

export default function NotFound() {
  return (
    <>
      <Card className="border-0 overflow-hidden shadow-none bg-white dark:bg-[#273142]">
        <CardContent className="py-10 lg:py-[60px] xl:py-[80px] px-8 text-center">
          <Image
            src={ErrorThumbnail}
            alt="Logo"
            width={454}
            height={454}
            className="mx-auto"
            priority
          />
          <h6 className="mb-4">Page not Found</h6>
          <p className="text-neutral-500 dark:text-neutral-300">
            Sorry, the page you are looking for doesn't exist{" "}
          </p>
          <Button variant="default" asChild className={cn(" mt-10")}>
            <Link href="/" className={cn("rounded-lg px-10 py-6")}>
              Back to Home
            </Link>
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
