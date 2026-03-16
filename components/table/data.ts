import { StaticImageData } from "next/image";
import UserImg1 from "@/public/assets/images/users/user1.png";
import UserImg2 from "@/public/assets/images/users/user2.png";
import UserImg3 from "@/public/assets/images/users/user3.png";
import UserImg4 from "@/public/assets/images/users/user4.png";
import UserImg5 from "@/public/assets/images/users/user5.png";

interface TransactionsDataType {
  name: string;
  email: string;
  image: StaticImageData;
  registered: string;
  plan: string;
  status: "Active" | "Inactive";
  statusVariant:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "success"
    | "warning"
    | "info"
    | "danger";
}

export const users: TransactionsDataType[] = [
  {
    name: "Dianne Russell",
    email: "redaniel@gmail.com",
    image: UserImg1,
    registered: "27 Mar 2024",
    plan: "Free",
    statusVariant: "success",
    status: "Active",
  },
  {
    name: "Wade Warren",
    email: "xterris@gmail.com",
    image: UserImg2,
    registered: "27 Mar 2024",
    plan: "Basic",
    statusVariant: "danger",
    status: "Inactive",
  },
  {
    name: "Albert Flores",
    email: "seannand@mail.ru",
    image: UserImg3,
    registered: "27 Mar 2024",
    plan: "Standard",
    statusVariant: "success",
    status: "Active",
  },
  {
    name: "Bessie Cooper",
    email: "igerrin@gmail.com",
    image: UserImg4,
    registered: "27 Mar 2024",
    plan: "Business",
    statusVariant: "danger",
    status: "Inactive",
  },
  {
    name: "Arlene McCoy",
    email: "fellora@mail.ru",
    image: UserImg5,
    registered: "27 Mar 2024",
    plan: "Enterprise",
    statusVariant: "success",
    status: "Active",
  },
  {
    name: "Bessie Cooper",
    email: "igerrin@gmail.com",
    image: UserImg4,
    registered: "27 Mar 2024",
    plan: "Business",
    statusVariant: "danger",
    status: "Inactive",
  },
  {
    name: "Arlene McCoy",
    email: "fellora@mail.ru",
    image: UserImg5,
    registered: "27 Mar 2024",
    plan: "Enterprise",
    statusVariant: "success",
    status: "Active",
  },
  {
    name: "Albert Flores",
    email: "seannand@mail.ru",
    image: UserImg3,
    registered: "27 Mar 2024",
    plan: "Standard",
    statusVariant: "success",
    status: "Active",
  },
  {
    name: "Bessie Cooper",
    email: "igerrin@gmail.com",
    image: UserImg4,
    registered: "27 Mar 2024",
    plan: "Business",
    statusVariant: "danger",
    status: "Inactive",
  },
  {
    name: "Dianne Russell",
    email: "redaniel@gmail.com",
    image: UserImg1,
    registered: "27 Mar 2024",
    plan: "Free",
    statusVariant: "success",
    status: "Active",
  },
];
