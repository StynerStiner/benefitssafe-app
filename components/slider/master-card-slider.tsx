import * as React from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Image, { StaticImageData } from "next/image";
import CardBG from "@/public/assets/images/card/card-bg.png";
import Logo from "@/public/assets/images/card/card-logo.png";
import { cn } from "@/lib/utils";

interface CreditCardType {
  id: number;
  type: string;
  number: string;
  name: string;
  expiry: string;
  cardBg: StaticImageData;
  cardLogo: StaticImageData;
}

export const creditCardData: CreditCardType[] = [
  {
    id: 1,
    type: "Virtual Card",
    number: "•••• •••• •••• 4242",
    name: "James Carter",
    expiry: "12/27",
    cardBg: CardBG,
    cardLogo: Logo,
  },
  {
    id: 2,
    type: "Virtual Card",
    number: "•••• •••• •••• 8888",
    name: "James Carter",
    expiry: "12/27",
    cardBg: CardBG,
    cardLogo: Logo,
  },
  {
    id: 3,
    type: "Virtual Card",
    number: "•••• •••• •••• 1234",
    name: "James Carter",
    expiry: "12/27",
    cardBg: CardBG,
    cardLogo: Logo,
  },
];

function MasterCardSlider() {
  return (
    <Carousel className="w-full">
      <CarouselContent>
        {creditCardData.map((card) => (
          <CarouselItem key={card.id}>
            <div
              className={`p-5 h-[240px] rounded-lg overflow-hidden relative z-[1]`}
            >
              <Image
                src={card.cardBg}
                alt="BG"
                fill
                priority
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="absolute start-0 top-0 w-full h-full object-cover -z-[1]"
              />
              <div className="flex flex-col justify-between h-full">
                <div className="flex items-center justify-between flex-wrap">
                  <h6 className="text-white mb-0">{card.type}</h6>
                  <Image
                    src={card.cardLogo}
                    alt="Logo"
                    width={70}
                    height={40}
                    priority
                    className="w-[70px] h-[40px]"
                  />
                </div>
                <div>
                  <span className="text-white text-xs font-normal text-opacity-75">
                    Credit Card Number
                  </span>
                  <h6 className="text-white text-xl font-semibold mt-1 mb-0">
                    {card.number}
                  </h6>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-white text-xs font-normal text-opacity-75">
                      Name
                    </span>
                    <h6 className="text-white text-xl font-semibold mb-0">
                      {card.name}
                    </h6>
                  </div>
                  <div>
                    <span className="text-white text-xs font-normal text-opacity-75">
                      Exp. Date
                    </span>
                    <h6 className="text-white text-xl font-semibold mb-0">
                      {card.expiry}
                    </h6>
                  </div>
                </div>
              </div>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>

      <CarouselPrevious
        className={cn("absolute top-[50%] -translate-[50%] start-0")}
      />
      <CarouselNext
        className={cn("absolute top-[50%] -translate-[50%] end-0")}
      />
    </Carousel>
  );
}

export default MasterCardSlider;
