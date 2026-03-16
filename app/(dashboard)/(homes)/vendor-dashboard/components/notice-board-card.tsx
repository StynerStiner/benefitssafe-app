import CommonLink from "@/components/shared/common-link";
import NoticeBoardList from "@/components/shared/notice-board-list";
import { Card, CardContent } from "@/components/ui/card";
import React from "react";

const NoticeBoardCard = () => {
  return (
    <Card className="card h-full border-0">
      <CardContent className="card-body p-0">
        <div className="flex items-center flex-wrap gap-2 justify-between mb-5">
          <h6 className="mb-0 font-bold text-lg">Notice board</h6>
          <CommonLink />
        </div>
        <NoticeBoardList />
      </CardContent>
    </Card>
  );
};
export default NoticeBoardCard;
