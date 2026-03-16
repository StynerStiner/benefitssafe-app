import TrailBgImage from "@/public/assets/images/home-nine/trail-bg.png";
import Link from "next/link";

const UpgradeNowCard = () => {
    return (
        <div className="trail-bg h-full text-center flex flex-col justify-between items-center p-4 rounded-lg bg-cover bg-no-repeat bg-center"
            style={{ backgroundImage: `url(${TrailBgImage.src})` }}
        >
            <h6 className="text-white text-xl mb-4">Export Reports</h6>
            <div className="">
                <p className="text-white mb-6">Download grant and expense reports</p>
                <Link
                    href="#"
                    className="w-full py-2 px-6 rounded-[50rem] bg-gradient-to-r from-[#CBFFF9] to-[#FFEEB1] text-sm justify-center dark:text-neutral-900 transform transition-transform duration-300 hover:scale-105 inline-flex items-center justify-center"
                >
                    Generate Report
                </Link>

            </div>
        </div>
    );
};

export default UpgradeNowCard;
