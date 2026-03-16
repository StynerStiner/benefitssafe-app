"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import userGridImage1 from "@/public/assets/images/user-grid/user-grid-img1.png";
import userGridImage2 from "@/public/assets/images/user-grid/user-grid-img2.png";
import userGridImage3 from "@/public/assets/images/user-grid/user-grid-img3.png";
import userGridImage4 from "@/public/assets/images/user-grid/user-grid-img4.png";
import userGridImage5 from "@/public/assets/images/user-grid/user-grid-img5.png";
import Image, { StaticImageData } from "next/image";

interface TeamMember {
  id: number;
  name: string;
  email: string;
  avatar: StaticImageData;
  taskCount: number;
  progress: number;
  progressColor: string;
}

const TransactionHistories: TeamMember[] = [
  {
    id: 1,
    name: "Kristin Watson",
    email: "ulfaha@mail.ru",
    avatar: userGridImage5,
    taskCount: 15,
    progress: 80,
    progressColor: "bg-purple-500",
  },
  {
    id: 2,
    name: "Theresa Webb",
    email: "joie@gmail.com",
    avatar: userGridImage4,
    taskCount: 20,
    progress: 50,
    progressColor: "bg-yellow-500",
  },
  {
    id: 3,
    name: "Brooklyn Simmons",
    email: "warn@mail.ru",
    avatar: userGridImage3,
    taskCount: 24,
    progress: 60,
    progressColor: "bg-cyan-500",
  },
  {
    id: 4,
    name: "Robert Fox",
    email: "fellora@mail.ru",
    avatar: userGridImage2,
    taskCount: 26,
    progress: 92,
    progressColor: "bg-green-500",
  },
  {
    id: 5,
    name: "Jane Cooper",
    email: "zitka@mail.ru",
    avatar: userGridImage1,
    taskCount: 25,
    progress: 25,
    progressColor: "bg-red-600",
  },
];

const TransactionHistorySassTable = () => {
  return (
    <Table className="table-auto border-spacing-0 border-separate">
      <TableHeader>
        <TableRow className="border-0">
          <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-4 h-12">
            Customer
          </TableHead>
          <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-4 h-12">
            Task
          </TableHead>
          <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-4 h-12 text-center">
            Progress
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {TransactionHistories.map((member, index) => {
          const isLast = index === TransactionHistories.length - 1;
          return (
            <TableRow key={member.id}>
              {/* Customer */}
              <TableCell
                className={`py-3.5 px-4 border-b border-neutral-200 dark:border-slate-600 ${
                  isLast ? "rounded-bl-lg" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <Image
                    src={member.avatar}
                    alt={member.name}
                    width={40}
                    height={40}
                    className="object-cover rounded-full flex-shrink-0"
                  />
                  <div>
                    <h6 className="text-base font-medium mb-0">
                      {member.name}
                    </h6>
                    <span className="text-sm text-neutral-500 dark:text-neutral-300 font-medium">
                      {member.email}
                    </span>
                  </div>
                </div>
              </TableCell>

              {/* Task Count */}
              <TableCell
                className={`py-3.5 px-4 border-b border-neutral-200 dark:border-slate-600 ${
                  isLast ? "rounded-bl-lg" : ""
                }`}
              >
                {member.taskCount}
              </TableCell>

              {/* Progress Bar */}
              <TableCell
                className={`py-3.5 px-4 border-b border-neutral-200 dark:border-slate-600 text-center ${
                  isLast ? "rounded-br-lg" : ""
                }`}
              >
                <div className="max-w-[112px] mx-auto w-full">
                  <div className="h-2 rounded-full bg-neutral-600/20 overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${member.progressColor}`}
                      style={{ width: `${member.progress}%` }}
                    ></div>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default TransactionHistorySassTable;
