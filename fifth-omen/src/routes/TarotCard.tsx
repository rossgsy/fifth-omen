import { useParams } from "@solidjs/router";
import { MajorArcana } from "../game";

const TarotCardRoute = () => {
    const params = useParams();
    let id = (Number)(params.id);


    return <div>
        <h2 class="gothic-sub-heading text-2xl text-center">{MajorArcana[id]}</h2>
    </div>
}

export default TarotCardRoute;