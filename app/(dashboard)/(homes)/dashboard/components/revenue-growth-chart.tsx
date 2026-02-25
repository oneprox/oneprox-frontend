"use client";

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import React from "react";
import { ApexOptions } from "apexcharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User } from "lucide-react";
import { dashboardApi, RevenueGrowth } from "@/lib/api"
import LoadingSkeleton from "@/components/loading-skeleton"

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

interface RevenueGrowthChartProps {
    selectedAssetId?: string
}

const RevenueGrowthChart = ({ selectedAssetId = 'all' }: RevenueGrowthChartProps) => {
    const [revenueData, setRevenueData] = useState<RevenueGrowth | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadRevenueGrowth()
    }, [selectedAssetId])

    const loadRevenueGrowth = async () => {
        try {
            setLoading(true)
            
            // If filtering by specific asset, we'll need to calculate manually
            // For now, use API and filter if needed
            const response = await dashboardApi.getRevenueGrowth()
            console.log('Revenue Growth API Response:', response)
            
            if (response.success && response.data) {
                // Backend returns data directly in response.data
                let revenueData = response.data as RevenueGrowth
                
                // If filtering by asset, we would need to filter the data
                // For now, if selectedAssetId is not 'all', we show empty or filtered data
                // This would require backend support or manual calculation
                if (selectedAssetId !== 'all') {
                    // TODO: Implement filtering by asset if backend supports it
                    // For now, show empty data when filtering
                    setRevenueData({ years: [], revenue: [] })
                } else {
                    setRevenueData(revenueData)
                }
            } else {
                console.error('Revenue Growth API Error:', response.error || response.message)
                setRevenueData(null)
            }
        } catch (err) {
            console.error('Error loading revenue growth:', err)
            setRevenueData(null)
        } finally {
            setLoading(false)
        }
    }

    const chartOptions: ApexOptions = {
        chart: {
            type: 'area',
            height: 300,
            toolbar: {
                show: false
            },
        },
        dataLabels: {
            enabled: false
        },
        stroke: {
            curve: 'smooth',
            width: 3,
            colors: ['#3B82F6'],
        },
        grid: {
            show: true,
            borderColor: '#E5E7EB',
            strokeDashArray: 3,
            xaxis: {
                lines: {
                    show: false
                }
            },
            yaxis: {
                lines: {
                    show: true,
                }
            },
        },
        fill: {
            type: 'gradient',
            colors: ['#3B82F6'],
            gradient: {
                shade: 'light',
                type: 'vertical',
                shadeIntensity: 0.3,
                gradientToColors: ['#3B82F600'],
                inverseColors: false,
                opacityFrom: 0.6,
                opacityTo: 0.1,
                stops: [0, 100],
            },
        },
        markers: {
            colors: ['#3B82F6'],
            strokeWidth: 3,
            size: 0,
            hover: {
                size: 8
            }
        },
        xaxis: {
            categories: revenueData?.years || [],
            labels: {
                style: {
                    fontSize: '14px',
                    colors: '#6B7280'
                }
            },
            axisBorder: {
                show: false
            },
        },
        yaxis: {
            labels: {
                formatter: function (value) {
                    if (value >= 2000000000) return 'Rp 2 M';
                    if (value >= 1000000000) return 'Rp 1 M';
                    if (value >= 500000000) return 'Rp 500 Juta';
                    if (value >= 100000000) return 'Rp 100 Juta';
                    return 'Rp 0';
                },
                style: {
                    fontSize: '14px',
                    colors: '#6B7280'
                }
            },
        },
        tooltip: {
            enabled: true,
            y: {
                formatter: function (value) {
                    return 'Rp ' + (value / 1000000).toFixed(0) + ' Juta';
                }
            }
        },
    };

    const chartSeries = [
        {
            name: 'Revenue',
            data: revenueData?.revenue || [],
        },
    ]

    if (loading) {
        return (
            <Card className="p-6 h-full flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <CardTitle className="text-lg font-semibold text-gray-700">
                        Revenue Growth
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                    <LoadingSkeleton height="h-[300px]" text="Memuat chart..." />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="p-6 h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-lg font-semibold text-gray-700">
                    Revenue Growth
                </CardTitle>
                <Select defaultValue="tahunan">
                    <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Tampilan Tahunan" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="tahunan">Tampilan Tahunan</SelectItem>
                        <SelectItem value="bulanan">Tampilan Bulanan</SelectItem>
                        <SelectItem value="mingguan">Tampilan Mingguan</SelectItem>
                    </SelectContent>
                </Select>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
                {revenueData?.revenue && revenueData.revenue.length > 0 ? (
                    <Chart
                        options={chartOptions}
                        series={chartSeries}
                        type="area"
                        height={300}
                    />
                ) : (
                    <div className="text-center py-8 text-muted-foreground">
                        <p>Tidak ada data revenue growth</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default RevenueGrowthChart;
