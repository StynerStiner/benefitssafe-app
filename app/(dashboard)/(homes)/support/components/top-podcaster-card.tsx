import CommonLink from "@/components/shared/common-link";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";
import Image, { StaticImageData } from "next/image";
import React from "react";
import podcasterImage1 from "@/public/assets/images/homeThirteen/podcaster-img1.png";
import podcasterImage2 from "@/public/assets/images/homeThirteen/podcaster-img2.png";
import podcasterImage3 from "@/public/assets/images/homeThirteen/podcaster-img3.png";
import podcasterImage4 from "@/public/assets/images/homeThirteen/podcaster-img4.png";
import podcasterImage5 from "@/public/assets/images/homeThirteen/podcaster-img5.png";

interface Podcaster {
  id: number;
  name: string;
  agentId: string;
  image: StaticImageData;
  rating: number;
}

const podcasters: Podcaster[] = [
  {
    id: 1,
    name: "Digital Assets",
    agentId: "UI Design",
    image: podcasterImage1,
    rating: 5.0
  },
  {
    id: 2,
    name: "Wade Warren",
    agentId: "36254",
    image: podcasterImage2,
    rating: 3.5
  },
  {
    id: 3,
    name: "Albert Flores",
    agentId: "36254",
    image: podcasterImage3,
    rating: 2.5
  },
  {
    id: 4,
    name: "Bessie Cooper",
    agentId: "36254",
    image: podcasterImage4,
    rating: 4.38
  },
  {
    id: 5,
    name: "Arlene McCoy",
    agentId: "36254",
    image: podcasterImage5,
    rating: 1.0
  },
  {
    id: 6,
    name: "Cody Fisher",
    agentId: "36254",
    image: podcasterImage1,
    rating: 4.7
  },
];

const TopPodcasterCard: React.FC = () => {
  // helper function to render stars dynamically
  const renderStars = (rating: number) => {
    const totalStars = 5;
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    return Array.from({ length: totalStars }, (_, i) => {
      if (i < fullStars) {
        // filled (yellow) stars
        return <Star key={i} className="w-4 h-4 fill-current text-yellow-500" />;
      } else if (i === fullStars && hasHalfStar) {
        // half star — use gradient
        return (
          <span key={i} className="relative w-4 h-4">
            <Star className="absolute top-0 left-0 w-4 h-4 text-neutral-400" />
            <Star
              className="absolute top-0 left-0 w-4 h-4 text-yellow-500"
              style={{
                clipPath: "inset(0 50% 0 0)",
                fill: "currentColor",
              }}
            />
          </span>
        );
      } else {
        // empty (neutral) stars
        return <Star key={i} className="w-4 h-4 text-neutral-400" />;
      }
    });
  };

  return (
    <Card className="card h-full rounded-lg border-0 !p-0">
      <CardContent className="card-body p-0 flex flex-col justify-between gap-8">
        <div>
          {/* Header */}
          <div className="card-header border-b border-neutral-200 dark:border-slate-500 py-4 px-6">
            <div className="flex items-center flex-wrap gap-2 justify-between">
              <h6 className="font-bold text-lg mb-0">Top Podcasters</h6>
              <CommonLink />
            </div>
          </div>

          {/* Podcasters List */}
          <div className="card-body py-4 px-6">
            {podcasters.map((podcaster, index) => (
              <div
                key={podcaster.id}
                className={`flex items-center justify-between gap-3 ${index === podcasters.length - 1 ? "" : "mb-4"
                  }`}
              >
                {/* Info */}
                <div className="flex items-center">
                  <Image
                    src={podcaster.image}
                    alt={podcaster.name}
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-full flex-shrink-0 me-3 overflow-hidden"
                  />
                  <div>
                    <h6 className="sm:text-base text-xs mb-0 font-medium">
                      {podcaster.name}
                    </h6>
                    <span className="text-sm text-neutral-600 dark:text-neutral-100 font-medium">
                      {podcaster.agentId}
                    </span>
                  </div>
                </div>

                {/* Rating */}
                <div className="text-right">
                  <div className="flex items-center gap-1.5 justify-end mb-1">
                    {renderStars(podcaster.rating)}
                  </div>
                  <span className="text-neutral-600 dark:text-neutral-100 text-sm">
                    {podcaster.rating.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TopPodcasterCard;
