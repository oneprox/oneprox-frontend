import React from 'react';
import { SidebarTrigger } from '../ui/sidebar';
import SearchBox from '../shared/search-box';
import { ModeToggle } from '../shared/mode-toggle';
import LanguageSelect from '../shared/language-select';
import MessageDropdown from '../shared/message-dropdown';
import NotificationDropdown from './../shared/notification-dropdown';
import ProfileDropdown from '../shared/profile-dropdown';

const Header = () => {
    return (
        <header
            className="fixed inset-x-0 top-0 z-50 flex w-full shrink-0 items-center justify-between gap-2 overflow-hidden border-b border-slate-200 bg-white/95 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/75 transition-[padding] duration-200 ease-linear dark:border-slate-700 dark:bg-[#273142] sm:h-18 h-13 md:px-6 px-4 md:pl-[calc(var(--sidebar-width)+(--spacing(0)))] md:peer-data-[collapsible=icon]:pl-[calc(var(--sidebar-width-icon)+(--spacing(4)))] md:peer-data-[collapsible=offcanvas]:pl-0"
        >
            <div className="flex items-center gap-4">
                {/* <SidebarTrigger className="-ms-1 size-[unset] cursor-pointer p-0" /> */}
                {/* <SearchBox /> */}
            </div>
            <div className="flex items-center gap-3">
                {/* <ModeToggle/> */}
                {/* <LanguageSelect/> */}
                {/* <MessageDropdown/> */}
                {/* <NotificationDropdown/> */}
                <ProfileDropdown />
            </div>
        </header>
    );
};

export default Header;
