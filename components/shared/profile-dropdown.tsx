import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { User, Mail, Settings } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import Logout from "@/components/auth/logout";
import userImg from "@/public/assets/images/user.png";
import { useSession } from "next-auth/react";
import { authApi } from "@/lib/api";

const ProfileDropdown = () => {
  const { data: session } = useSession();
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  useEffect(() => {
    const loadUser = async () => {
      const user = await authApi.getCurrentUser();
      setCurrentUser(user);
    };
    loadUser();
  }, []);
  
  console.log("session", session?.user?.image);

  return (
    <div className="flex-shrink-0 relative z-50" style={{ minWidth: '40px', minHeight: '40px' }}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "rounded-full sm:w-10 sm:h-10 w-8 h-8 bg-gray-200/75 hover:bg-slate-200 focus-visible:ring-0 dark:bg-slate-700 dark:hover:bg-slate-600 border-0 cursor-pointer data-[state=open]:bg-gray-300 data-[state=open]:ring-4 data-[state=open]:ring-slate-300 dark:data-[state=open]:ring-slate-500 dark:data-[state=open]:bg-slate-600 flex-shrink-0 relative"
            )}
            style={{ minWidth: '40px', minHeight: '40px' }}
          >
          {(session?.user?.image || currentUser?.image) ? (
            <Image
              src={session?.user?.image || currentUser?.image}
              className="rounded-full object-cover"
              width={40}
              height={40}
              alt={currentUser?.name || session?.user?.name || "User profile"}
            />
          ) : (
            <Image
              src={userImg}
              className="rounded-full object-cover"
              width={40}
              height={40}
              alt={currentUser?.name || "User profile"}
            />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="sm:w-[300px] min-w-[250px] p-4 rounded-2xl overflow-hidden shadow-lg z-[100]"
        side="bottom"
        align="end"
      >
        <div className="py-3 px-4 rounded-lg bg-primary/10 dark:bg-primar flex items-center justify-between">
          <div>
            <h6 className="text-lg text-neutral-900 dark:text-white font-semibold mb-0">
              {currentUser?.name || session?.user?.name || "User"}
            </h6>
            <span className="text-sm text-neutral-500 dark:text-neutral-300">
              {currentUser?.role?.name || currentUser?.roleName || "User"}
            </span>
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto scroll-sm pt-4">
          <ul className="flex flex-col gap-3">
            <li>
              <Link
                href="/view-profile"
                className="text-black dark:text-white hover:text-primary dark:hover:text-primary flex items-center gap-3"
              >
                <User className="w-5 h-5" /> My Profile
              </Link>
            </li>
            <li>
              <Logout />
            </li>
          </ul>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
    </div>
  );
};

export default ProfileDropdown;
