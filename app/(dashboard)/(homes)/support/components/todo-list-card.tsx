"use client";

import CommonLink from "@/components/shared/common-link";
import TodoListTable from "@/components/table/todo-list-table";
import { Card, CardContent } from "@/components/ui/card";

interface NotificationItem {
    id: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
}

interface UserItem {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    role: string;
}

interface TodoListCardProps {
    notifications: NotificationItem[];
    users: UserItem[];
}

const TodoListCard = ({ notifications, users }: TodoListCardProps) => {
    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-0 h-full">
                <div className="flex items-center flex-wrap gap-2 justify-between px-6 py-4">
                    <h3 className="font-bold text-lg mb-0">Support Tickets</h3>
                    <CommonLink />
                </div>

                {/* Transactions List */}
                <div className="">
                    <TodoListTable notifications={notifications} users={users} />
                </div>
            </CardContent>
        </Card>
    );
};

export default TodoListCard;