/*!
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import React from "react";
import { Box, Tooltip, Flex } from "@chakra-ui/react";

import useSelection from "src/dag/useSelection";
import { getDuration } from "src/datetime_utils";
import { SimpleStatus, boxSize } from "src/dag/StatusBox";
import { useContainerRef } from "src/context/containerRef";
import { hoverDelay } from "src/utils";
import type { Task } from "src/types";
import { useTaskFails } from "src/api";

import GanttTooltip from "./GanttTooltip";
import TaskFail from "./TaskFail";

interface Props {
  ganttWidth?: number;
  openGroupIds: string[];
  task: Task;
  ganttStartDate?: string | null;
  ganttEndDate?: string | null;
}

const Row = ({
  ganttWidth = 500,
  openGroupIds,
  task,
  ganttStartDate,
  ganttEndDate,
}: Props) => {
  const {
    selected: { runId, taskId },
    onSelect,
  } = useSelection();
  const containerRef = useContainerRef();

  const runDuration = getDuration(ganttStartDate, ganttEndDate);

  const instance = task.instances.find((ti) => ti.runId === runId);
  const isSelected = taskId === instance?.taskId;
  const hasValidQueuedDttm =
    !!instance?.queuedDttm &&
    (instance?.startDate && instance?.queuedDttm
      ? instance.queuedDttm < instance.startDate
      : true);
  const isOpen = openGroupIds.includes(task.id || "");

  const { data: taskFails } = useTaskFails({
    taskId: task.id || undefined,
    runId: runId || undefined,
    enabled: !!(instance?.tryNumber && instance?.tryNumber > 1) && !!task.id, // Only try to look up task fails if it even has a try number > 1
  });

  // Calculate durations in ms
  const taskDuration = getDuration(instance?.startDate, instance?.endDate);
  const queuedDuration = hasValidQueuedDttm
    ? getDuration(instance?.queuedDttm, instance?.startDate)
    : 0;
  const taskStartOffset = hasValidQueuedDttm
    ? getDuration(ganttStartDate, instance?.queuedDttm || instance?.startDate)
    : getDuration(ganttStartDate, instance?.startDate);

  // Percent of each duration vs the overall dag run
  const taskDurationPercent = taskDuration / runDuration;
  const taskStartOffsetPercent = taskStartOffset / runDuration;
  const queuedDurationPercent = queuedDuration / runDuration;

  // Calculate the pixel width of the queued and task bars and the position in the graph
  // Min width should be 5px
  let width = ganttWidth * taskDurationPercent;
  if (width < 5) width = 5;
  let queuedWidth = hasValidQueuedDttm ? ganttWidth * queuedDurationPercent : 0;
  if (hasValidQueuedDttm && queuedWidth < 5) queuedWidth = 5;
  const offsetMargin = taskStartOffsetPercent * ganttWidth;

  return (
    <div>
      <Box
        borderBottomWidth={1}
        borderBottomColor={!!task.children && isOpen ? "gray.400" : "gray.200"}
        bg={isSelected ? "blue.100" : "inherit"}
        position="relative"
        width={ganttWidth}
        height={`${boxSize + 9}px`}
      >
        {instance && (
          <Tooltip
            label={<GanttTooltip task={task} instance={instance} />}
            hasArrow
            portalProps={{ containerRef }}
            placement="top"
            openDelay={hoverDelay}
          >
            <Flex
              width={`${width + queuedWidth}px`}
              position="absolute"
              cursor="pointer"
              pointerEvents="auto"
              top="4px"
              left={`${offsetMargin}px`}
              onClick={() => {
                onSelect({
                  runId: instance.runId,
                  taskId: instance.taskId,
                });
              }}
            >
              {instance.state !== "queued" && hasValidQueuedDttm && (
                <SimpleStatus
                  state="queued"
                  width={`${queuedWidth}px`}
                  borderRightRadius={0}
                  // The normal queued color is too dark when next to the actual task's state
                  opacity={0.6}
                />
              )}
              <SimpleStatus
                state={instance.state}
                width={`${width}px`}
                borderLeftRadius={
                  instance.state !== "queued" && hasValidQueuedDttm
                    ? 0
                    : undefined
                }
              />
            </Flex>
          </Tooltip>
        )}
        {/* Only show fails before the most recent task instance */}
        {(taskFails || [])
          .filter(
            (tf) =>
              tf.startDate !== instance?.startDate &&
              // @ts-ignore
              moment(tf.startDate).isAfter(ganttStartDate)
          )
          .map((taskFail) => (
            <TaskFail
              key={`${taskFail.taskId}-${taskFail.startDate}`}
              taskFail={taskFail}
              ganttStartDate={ganttStartDate}
              ganttWidth={ganttWidth}
              runDuration={runDuration}
            />
          ))}
      </Box>
      {isOpen &&
        !!task.children &&
        task.children.map((c) => (
          <Row
            ganttWidth={ganttWidth}
            openGroupIds={openGroupIds}
            ganttStartDate={ganttStartDate}
            ganttEndDate={ganttEndDate}
            task={c}
            key={`gantt-${c.id}`}
          />
        ))}
    </div>
  );
};

export default Row;
