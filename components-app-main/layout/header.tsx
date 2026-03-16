import LanguageSelect from '../shared/language-select';
import MessageDropdown from '../shared/message-dropdown';
import { ModeToggle } from '../shared/mode-toggle';
import ProfileDropdown from '../shared/profile-dropdown';
import SearchBox from '../shared/search-box';
import { SidebarTrigger } from '../ui/sidebar';
import NotificationDropdown from './../shared/notification-dropdown';

const Header = () => {
    return (
        <header className="dashboard-header flex items-center justify-between sm:h-18 h-13 shrink-0 gap-2 md:px-6 px-4 py-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-18 dark:bg-[#273142]">
            <div className="flex items-center gap-4">
                <SidebarTrigger className="-ms-1 p-0 size-[unset] cursor-pointer" />
                <SearchBox />
            </div>
            <div className="flex items-center gap-3">
                <ModeToggle />
                <LanguageSelect />
                <MessageDropdown />
                <NotificationDropdown />
                <ProfileDropdown />
            </div>
        </header>
    );
};

export default Header;