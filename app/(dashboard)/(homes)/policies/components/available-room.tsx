import SemiCircleGaugeTwo from "@/components/charts/semi-circle-gauge-two";

const AvailableRoom = ({ policy }: { policy: unknown }) => {
    return (
        <div className="shadow-7 p-6 rounded-xl bg-white dark:bg-[#273142] h-full">
            <div className="text-center">
                <div className="relative">
                    <div className="big-semi-circle-gauge flex justify-center">
                        <SemiCircleGaugeTwo />
                    </div>
                    <span
                        className="w-[90px] h-[90px] rounded-[50%] bg-primary-50 flex justify-center items-center absolute start-[50%] bottom-0 translate-x-[-50%] rtl:translate-x-[50%]">
                        <img src="assets/images/home-twelve/icons/home.png" alt="Home Icon" />
                    </span>
                </div>
                <h3 className="mt-10 mb-0 leading-none">35</h3>
                <span className="text-neutral-800 dark:text-neutral-300 mt-4">Payment Rules Active</span>
            </div>
        </div>
    );
};

export default AvailableRoom;