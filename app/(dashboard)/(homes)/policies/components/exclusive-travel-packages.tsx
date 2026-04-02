import ExclusiveTravelPackagesSlider from "@/components/slider/exclusive-travel-packages-slider";

interface Grant {
    id: string;
    name: string;
    totalAmount: string;
    spentAmount: string;
    status: string;
}

const ExclusiveTravelPackages = ({ grants }: { grants: Grant[] }) => {
    return (
        <>
            <ExclusiveTravelPackagesSlider grants={grants} />
        </>
    );
};

export default ExclusiveTravelPackages;
