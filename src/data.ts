import $ from "jquery";
import * as _ from "lodash";

export interface Segment {
    parent: string,
    creator: string,
    order: number,
    id: string,
    sortBy: string,
    group: string
}

export interface SketchData {
    // pre-sorted by segment order
    readonly segments:Segment[]
    readonly sortBy:string
    readonly lastSegment:Segment
}

export function extractDataFromImg(img: HTMLImageElement): Segment {
    let el = $(img)
    let id = el.data("id")
    return {
        "parent": el.data("parent"),
        "creator": el.data("creator"),
        "order": el.data("order"),
        "id": id,
        "sortBy": id,
        "group": el.data("group")
    }
}

export function load(): SketchData[] {
    let allSegments: Segment[] = []
    let allSegmentsKeyId = new Map<string, Segment>()
    let completeSegmentIds: string[] = []
    $('.imageDataLoader').each(function () {
        let data = extractDataFromImg(this as HTMLImageElement)
        allSegments.push(data)
        allSegmentsKeyId.set(data.id, data)
        if (data.order === 2) {
            completeSegmentIds.push(data.id)
        }
    })

    if (allSegments.length == 0) {
        return null
    }

    completeSegmentIds.sort()

    let groupByGroup = _.groupBy(allSegments, function (s) {
        return s.group
    })

    // const out = new Array<Map<string,Segment>>()
    // ordered by id

    let out = _.map(groupByGroup, function (group: Segment[]) {
        let segments = _.sortBy(group, function (g: Segment) {
            return g.order
        })
        return {
            segments:segments,
            sortBy:segments[segments.length-1].id,
            lastSegment:segments[segments.length-1]
        }
    })

    // sort groups by the completed segment id
    out = _.sortBy(out, function (group: SketchData) {
        return group.sortBy
    })
    return out
    // _.each(completeSegmentIds, function (c: string) {
    //     let group = groupByGroup[allSegmentsKeyId.get(c).group]
    //     let segments = new Map<string, Segment>()
    //     for (let s of group) {
    //         segments.set(s.id, s)
    //     }
    //     out.push(segments)
    //     // newSketch(segments, newSketchContainerEl())
    // })
    // return out
}