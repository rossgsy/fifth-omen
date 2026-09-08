import { Icon } from "@iconify-icon/solid";
import type { JSX, ParentProps } from "solid-js";

type ClassProp = {
    class?: string;
};

const cx = (...classes: Array<string | undefined | false>) => (
    classes.filter(Boolean).join(" ")
);

type PageProps = ParentProps<ClassProp>;

export const Page = (props: PageProps) => (
    <main class={cx("flex min-h-0 grow flex-col gap-4 p-4", props.class)}>
        {props.children}
    </main>
);

type PanelProps = ParentProps<ClassProp & {
    as?: "div" | "section";
    interactive?: boolean;
    onClick?: JSX.EventHandlerUnion<HTMLElement, MouseEvent>;
}>;

export const Panel = (props: PanelProps) => {
    const classes = () => cx(
        "border border-zinc-700 bg-zinc-950",
        props.interactive && "cursor-pointer transition-all hover:border-zinc-500 hover:bg-zinc-900",
        props.class,
    );

    return props.as === "section"
        ? <section onClick={props.onClick as JSX.EventHandlerUnion<HTMLElement, MouseEvent>} class={classes()}>{props.children}</section>
        : <div onClick={props.onClick as JSX.EventHandlerUnion<HTMLDivElement, MouseEvent>} class={classes()}>{props.children}</div>;
};

type SectionHeadingProps = ClassProp & {
    eyebrow?: JSX.Element;
    title: JSX.Element;
    subtitle?: JSX.Element;
    titleClass?: string;
};

export const SectionHeading = (props: SectionHeadingProps) => (
    <div class={cx("flex flex-col items-center justify-center gap-2 text-center", props.class)}>
        {props.eyebrow && (
            <p class="text-xs uppercase tracking-[0.22em] text-zinc-600">
                {props.eyebrow}
            </p>
        )}
        <h2 class={cx("gothic-sub-heading text-2xl text-zinc-100", props.titleClass)}>
            {props.title}
        </h2>
        {props.subtitle && (
            <p class="text-zinc-500">
                {props.subtitle}
            </p>
        )}
    </div>
);

export const Divider = (props: ClassProp & { ornament?: boolean }) => (
    <div class={cx("flex items-center gap-3", props.class)}>
        <div class="h-px flex-1 bg-zinc-800" />
        {props.ornament && <span class="text-xs text-zinc-600">◆</span>}
        <div class="h-px flex-1 bg-zinc-800" />
    </div>
);

type ButtonProps = ParentProps<ClassProp & {
    disabled?: boolean;
    onClick?: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent>;
    type?: "button" | "submit" | "reset";
}>;

export const Button = (props: ButtonProps) => (
    <button
        type={props.type ?? "button"}
        onClick={props.onClick}
        disabled={props.disabled}
        class={cx(
            "rounded bg-zinc-700 px-4 py-2 text-zinc-100 transition-colors hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-zinc-700",
            props.class,
        )}
    >
        {props.children}
    </button>
);

type ConfirmDialogProps = {
    eyebrow?: JSX.Element;
    title: JSX.Element;
    message?: JSX.Element;
    confirmLabel?: JSX.Element;
    cancelLabel?: JSX.Element;
    destructive?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
};

export const ConfirmDialog = (props: ConfirmDialogProps) => (
    <div class="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6 backdrop-blur-sm">
        <Panel class="w-full max-w-md p-6 text-center shadow-2xl">
            <SectionHeading
                eyebrow={props.eyebrow}
                title={props.title}
                subtitle={props.message}
                titleClass="text-2xl tracking-wide"
            />

            <div class="mt-6 grid grid-cols-2 gap-3">
                <Button
                    class="min-h-12 bg-zinc-800 uppercase tracking-[0.14em] hover:bg-zinc-700"
                    onClick={props.onCancel}
                >
                    {props.cancelLabel ?? "Cancel"}
                </Button>
                <Button
                    class={props.destructive
                        ? "min-h-12 bg-red-900 uppercase tracking-[0.14em] hover:bg-red-800"
                        : "min-h-12 bg-zinc-100 uppercase tracking-[0.14em] text-zinc-950 hover:bg-zinc-300"}
                    onClick={props.onConfirm}
                >
                    {props.confirmLabel ?? "Confirm"}
                </Button>
            </div>
        </Panel>
    </div>
);

type IconButtonProps = ClassProp & {
    href?: string;
    icon: string;
    label: string;
    tone?: "red" | "purple" | "teal" | "orange" | "zinc";
    iconClass?: string;
    onClick?: JSX.EventHandlerUnion<HTMLElement, MouseEvent>;
};

const iconButtonTone = (tone: IconButtonProps["tone"]) => {
    switch (tone) {
        case "red":
            return "bg-red-800 hover:bg-red-700";
        case "purple":
            return "bg-purple-800 hover:bg-purple-700";
        case "teal":
            return "bg-teal-800 hover:bg-teal-700";
        case "orange":
            return "bg-orange-800 hover:bg-orange-700";
        default:
            return "bg-zinc-800 hover:bg-zinc-700";
    }
};

export const IconButton = (props: IconButtonProps) => {
    const classes = () => cx(
        "flex rounded-full p-4 text-white transition-colors",
        iconButtonTone(props.tone),
        props.class,
    );
    const icon = () => (
        <Icon
            icon={props.icon}
            class={cx("text-2xl", props.iconClass)}
        />
    );

    return props.href ? (
        <a href={props.href} aria-label={props.label} title={props.label} class={classes()}>
            {icon()}
        </a>
    ) : (
        <button
            type="button"
            aria-label={props.label}
            title={props.label}
            onClick={props.onClick as JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent>}
            class={classes()}
        >
            {icon()}
        </button>
    );
};

type ActionCardProps = ParentProps<ClassProp & {
    eyebrow?: JSX.Element;
    title: JSX.Element;
    href?: string;
    onClick?: JSX.EventHandlerUnion<HTMLElement, MouseEvent>;
}>;

export const ActionCard = (props: ActionCardProps) => {
    const content = () => (
        <>
            {props.eyebrow && (
                <p class="text-xs uppercase tracking-[0.22em] text-zinc-600">
                    {props.eyebrow}
                </p>
            )}
            <p class="mt-1 text-xl text-zinc-100">
                {props.title}
            </p>
            {props.children}
        </>
    );

    const classes = () => cx(
        "border border-zinc-700 bg-zinc-950 p-5 transition-all hover:border-zinc-500 hover:bg-zinc-900",
        (props.href || props.onClick) && "cursor-pointer",
        props.class,
    );

    return props.href ? (
        <a href={props.href} class={classes()}>
            {content()}
        </a>
    ) : (
        <div onClick={props.onClick} class={classes()}>
            {content()}
        </div>
    );
};
